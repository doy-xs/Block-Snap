package com.github.doyxs.blocksnap.common.utils;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

/**
 * JWT 生成与解析。
 * <p>
 * 保持纯静态工具类，不依赖 Spring 扫描——因为 gateway（WebFlux）的 @SpringBootApplication
 * 默认只扫描自身包，不扫 common；若改为 @Component + @PostConstruct，gateway 不会实例化它，
 * 静态字段将保持 null 导致 NPE。
 * <p>
 * 密钥与过期时间通过 JVM 系统属性 / 环境变量外部化（带默认值），生产环境应通过启动参数覆盖：
 *   -Dblock.snap.jwt.secret=... 或 BLOCK_SNAP_JWT_SECRET=...
 */
public final class JwtUtils {

    private static final String DEFAULT_SECRET =
            "block-snap-microservice-super-secret-key-2026-change-in-production";

    private static final SecretKey SECRET_KEY = Keys.hmacShaKeyFor(
            System.getProperty("block.snap.jwt.secret",
                    System.getenv().getOrDefault("BLOCK_SNAP_JWT_SECRET", DEFAULT_SECRET))
                    .getBytes(StandardCharsets.UTF_8));

    private static final long EXPIRATION_TIME = 1000L * 60 * 60 * 2;

    private JwtUtils() {}

    public static String generateToken(Long userId, String username) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("userId", userId);
        claims.put("username", username);

        Date now = new Date();
        Date expirationDate = new Date(now.getTime() + EXPIRATION_TIME);

        return Jwts.builder()
                .claims(claims)
                .subject(username)
                .issuedAt(now)
                .expiration(expirationDate)
                .signWith(SECRET_KEY, Jwts.SIG.HS256)
                .compact();
    }

    public static Claims parseToken(String token) {
        return Jwts.parser()
                .verifyWith(SECRET_KEY)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
