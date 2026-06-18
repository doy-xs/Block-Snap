package com.github.doyxs.blocksnap.service;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

// scanBasePackages 极其重要：确保能扫描到 common 模块里的全局异常处理器 GlobalExceptionHandler
@SpringBootApplication(scanBasePackages = {"com.github.doyxs.blocksnap"})
@EnableDiscoveryClient
public class ServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(ServiceApplication.class, args);
    }
}