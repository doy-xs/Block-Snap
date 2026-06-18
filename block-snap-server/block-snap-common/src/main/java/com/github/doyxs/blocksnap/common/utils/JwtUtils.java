package com.github.doyxs.blocksnap.common.utils;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

public class JwtUtils {

    // 【重要】服务端的私钥。真实环境中应该写在 Nacos 配置文件里。
    private static final String SECRET_STRING = "block-snap-microservice-super-secret-key-2026";

    // 1. 明确指定 UTF-8 编码，并且推荐使用 SecretKey 类型而不是基础的 Key 类型
    private static final SecretKey SECRET_KEY = Keys.hmacShaKeyFor(SECRET_STRING.getBytes(StandardCharsets.UTF_8));

    // Token 的有效时间，设置 2 小时 (毫秒)
    private static final long EXPIRATION_TIME = 1000 * 60 * 60 * 2;

    /**
     * 生成 JWT
     * @param userId   用户主键
     * @param username 用户名
     * @return 拼装好的 Token 字符串
     */
    public static String generateToken(Long userId, String username) {
        // 构建 Payload 中的自定义数据
        Map<String, Object> claims = new HashMap<>();
        claims.put("userId", userId);
        claims.put("username", username);

        Date now = new Date();
        Date expirationDate = new Date(now.getTime() + EXPIRATION_TIME);

        return Jwts.builder()
                .claims(claims)                     // 2. 去掉了 set 前缀
                .subject(username)                  // 主体通常设为用户名
                .issuedAt(now)                      // 签发时间
                .expiration(expirationDate)         // 过期时间
                .signWith(SECRET_KEY, Jwts.SIG.HS256) // 3. 使用新版的签名算法常量
                .compact();
    }

    /**
     * 解析并校验 JWT (适配 JJWT 0.12.x)
     * @param token 前端传来的 token 字符串
     * @return 解析后的 Claims（包含 userId 和 username）。如果报错说明 Token 伪造或过期。
     */
    public static Claims parseToken(String token) {
        return Jwts.parser()
                .verifyWith(SECRET_KEY)       // 1. 设置用于验证签名的密钥
                .build()                      // 2. 构建解析器
                .parseSignedClaims(token)     // 3. 解析并验证 Token 字符串
                .getPayload();                // 4. 获取其中的有效负载 (即 Claims)
    }}