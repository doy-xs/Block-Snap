package com.github.doyxs.blocksnap.system.model.dto;

import lombok.Data;

@Data
public class LoginDTO {
    // 专门用于接收前端登录请求的参数
    private String username;
    private String password;
}