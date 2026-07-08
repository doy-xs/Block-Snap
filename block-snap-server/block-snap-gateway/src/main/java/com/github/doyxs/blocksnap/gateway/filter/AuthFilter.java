package com.github.doyxs.blocksnap.gateway.filter;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.doyxs.blocksnap.common.api.Result;
import com.github.doyxs.blocksnap.common.constant.RedisConst;
import com.github.doyxs.blocksnap.common.enums.ResultCode;
import com.github.doyxs.blocksnap.common.utils.JwtUtils;
import io.jsonwebtoken.Claims;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@Component
public class AuthFilter implements GlobalFilter, Ordered {
    private static final AntPathMatcher PATH_MATCHER = new AntPathMatcher();
    private static final String[] WHITE_LIST = {"/sys-user/login", "/sys-user/register", "/sys-user/send-verification-code", "/sys-user/forgot-password"};
    @Autowired
    private RedisTemplate<String, String> redisTemplate;
    
    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        ServerHttpResponse response = exchange.getResponse();
        String path = request.getURI().getPath();
        // 1. 【安全修改】：直接在这里使用 WebFlux 原生方式获取 IP，不依赖 Common 模块
        String clientIp = request.getHeaders().getFirst("X-Forwarded-For");
        if (!StringUtils.hasText(clientIp) || "unknown".equalsIgnoreCase(clientIp)) {
            clientIp = request.getHeaders().getFirst("X-Real-IP");
        }
        if (!StringUtils.hasText(clientIp) || "unknown".equalsIgnoreCase(clientIp)) {
            java.net.InetSocketAddress remoteAddress = request.getRemoteAddress();
            clientIp = (remoteAddress != null) ? remoteAddress.getAddress().getHostAddress() : "unknown";
        }
        if (StringUtils.hasText(clientIp) && clientIp.contains(",")) {
            clientIp = clientIp.split(",")[0].trim();
        }
        ServerHttpRequest.Builder requestBuilder = request.mutate().header("X-Client-IP", clientIp);
        // 2. 白名单放行
        for (String url : WHITE_LIST) {
            if (PATH_MATCHER.match(url, path)) {
                return chain.filter(exchange.mutate().request(requestBuilder.build()).build());
            }
        }
        // 3. Token 校验
        String token = request.getHeaders().getFirst("Authorization");
        if (!StringUtils.hasText(token) || !token.startsWith("Bearer ")) {
            return reject(response, ResultCode.UNAUTHORIZED, "请求头缺失 Token 或格式错误");
        }
        Claims claims;
        String realToken;
        try {
            realToken = token.substring(7);
            claims = JwtUtils.parseToken(realToken);
        } catch (Exception e) {
            return reject(response, ResultCode.UNAUTHORIZED, "Token 已过期或不合法");
        }
        String userId = claims.get("userId").toString();
        String username = claims.get("username").toString();
        String redisToken = redisTemplate.opsForValue().get(RedisConst.LOGIN_TOKEN_PREFIX + userId);
        if (!realToken.equals(redisToken)) {
            return reject(response, ResultCode.UNAUTHORIZED, "您的账号已在别处登录或已退出，请重新登录");
        }
        requestBuilder.header("X-User-Id", userId).header("X-User-Name", username);
        return chain.filter(exchange.mutate().request(requestBuilder.build()).build());
    }
    
    private Mono<Void> reject(ServerHttpResponse response, ResultCode resultCode, String message) {
        response.setStatusCode(HttpStatus.UNAUTHORIZED);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
        Result<String> result = Result.failed(resultCode);
        result.setMessage(message);
        ObjectMapper mapper = new ObjectMapper();
        try {
            byte[] bytes = mapper.writeValueAsBytes(result);
            DataBuffer buffer = response.bufferFactory().wrap(bytes);
            return response.writeWith(Mono.just(buffer));
        } catch (JsonProcessingException e) {
            e.printStackTrace();
            return response.setComplete();
        }
    }
    
    @Override
    public int getOrder() {
        return 0;
    }
}