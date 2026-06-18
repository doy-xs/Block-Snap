package com.github.doyxs.blocksnap.common.constant;

/**
 * Redis 全局缓存 Key 与 过期时间常量池
 */
public final class RedisConst { // 1. 类加上 final，防止被继承

    // 2. 构造方法私有化，防止别人 new RedisConst()，彻底把它变成一个工具/常量类
    private RedisConst() {}

    // 3. 必须显式声明 public static final
    // ==================== 缓存 Key 前缀 ====================
    public static final String LOGIN_TOKEN_PREFIX = "block-snap:auth:token:"; // 建议前缀统一加上项目名
    public static final String VERIFY_CODE_PREFIX = "block-snap:system:verification-code:";
    public static final String COOLDOWN_PREFIX = "block-snap:system:cooldown:";
    public static final String VERIFY_ACCOUNT_TOKEN_PREFIX = "block-snap:system:verify-account-token:";

    // ==================== 过期时间 (魔法数字) ====================
    public static final long LOGIN_TOKEN_TTL = 2L;
    public static final long VERIFY_CODE_TTL = 5L;
    public static final long COOLDOWN_TTL = 60L;
    public static final long REBIND_TOKEN_TTL = 15L;
}