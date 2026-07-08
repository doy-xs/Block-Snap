package com.github.doyxs.blocksnap.system.util;

import jakarta.servlet.http.HttpServletRequest;

/**
 * HTTP 请求 IP 解析。仅 system 模块使用，故放在 system 而非 common，
 * 避免 common 库被迫依赖 servlet 容器（tomcat-embed-core）。
 */
public final class IpUtils {

    private IpUtils() {}

    public static String getIpAddr(HttpServletRequest request) {
        if (request == null) return "unknown";
        String ip = request.getHeader("X-Client-IP");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) ip = request.getHeader("Proxy-Client-IP");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) ip = request.getHeader("WL-Proxy-Client-IP");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) ip = request.getRemoteAddr();

        if (ip != null && ip.length() > 15 && ip.contains(",")) {
            ip = ip.substring(0, ip.indexOf(","));
        }
        return "0:0:0:0:0:0:0:1".equals(ip) ? "127.0.0.1" : ip;
    }
}
