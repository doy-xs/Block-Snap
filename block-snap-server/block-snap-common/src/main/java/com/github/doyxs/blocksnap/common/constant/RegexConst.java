package com.github.doyxs.blocksnap.common.constant;

public final class RegexConst {

    private RegexConst() {} // 同样私有化构造器

    /** 手机号正则 (中国大陆 13-19 开头) */
    public static final String PHONE = "^1[3-9]\\d{9}$";

    /** 邮箱正则 */
    public static final String EMAIL = "^[A-Za-z0-9+_.-]+@(.+)$";
}