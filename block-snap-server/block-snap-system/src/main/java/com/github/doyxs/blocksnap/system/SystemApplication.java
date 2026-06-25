package com.github.doyxs.blocksnap.system;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

@SpringBootApplication(scanBasePackages = {"com.github.doyxs.blocksnap"})

@EnableDiscoveryClient
public class SystemApplication {
    public static void main(String[] args) {
        new SpringApplicationBuilder(SystemApplication.class)
                .profiles("system")
                .run(args);
    }
}
