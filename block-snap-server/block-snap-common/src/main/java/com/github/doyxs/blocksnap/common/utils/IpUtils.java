package com.github.doyxs.blocksnap.common.utils;

import jakarta.servlet.http.HttpServletRequest;

public class IpUtils {

    /**
     * 专供普通 Spring Boot (System 模块) 使用的 IP 获取
     */
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