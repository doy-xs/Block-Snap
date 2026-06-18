package com.github.doyxs.blocksnap.system.interceptor;

import com.github.doyxs.blocksnap.common.constant.RedisConst;
import com.github.doyxs.blocksnap.common.constant.SceneConst;
import com.github.doyxs.blocksnap.common.exception.ApiException;
import com.github.doyxs.blocksnap.system.model.entity.SysUser;
import com.github.doyxs.blocksnap.system.service.ISysUserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class VerifyTokenInterceptor implements HandlerInterceptor {

    @Autowired
    private RedisTemplate<String, String> redisTemplate;

    @Autowired
    private ISysUserService sysUserService;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        String userIdStr = request.getHeader("X-User-Id");
        if (!StringUtils.hasText(userIdStr)) {
            throw new ApiException("未获取到当前登录用户信息");
        }
        Long userId = Long.valueOf(userIdStr);

        String uri = request.getRequestURI();
        if (uri.contains("/bind-account")) {
            SysUser user = sysUserService.getById(userId);
            if (user != null && !StringUtils.hasText(user.getPhone()) && !StringUtils.hasText(user.getEmail())) {
                return true;
            }
        }

        String verifyToken = request.getHeader("Verify-Token");
        if (!StringUtils.hasText(verifyToken)) {
            throw new ApiException("缺少二次验证凭证，请先完成安全验证！");
        }

        String redisKey = RedisConst.VERIFY_ACCOUNT_TOKEN_PREFIX + SceneConst.VERIFY_ACCOUNT + ":" + userIdStr;
        String realToken = redisTemplate.opsForValue().get(redisKey);

        if (!StringUtils.hasText(realToken) || !verifyToken.equals(realToken)) {
            throw new ApiException("二次验证无效或已过期");
        }
        return true;
    }
}