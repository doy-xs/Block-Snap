package com.github.doyxs.blocksnap.system.config;

import com.github.doyxs.blocksnap.system.interceptor.VerifyTokenInterceptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Autowired
    private VerifyTokenInterceptor verifyTokenInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // 注册拦截器，并指定只拦截下面这两个敏感接口
        registry.addInterceptor(verifyTokenInterceptor)
                .addPathPatterns(
                        "/sys-user/update-password", 
                        "/sys-user/bind-account"
                );
    }
}