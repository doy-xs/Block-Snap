package com.github.doyxs.blocksnap.system.model.dto;

import lombok.Data;

@Data
public class RegisterDTO {
    private String username;
    private String password;
    private String confirmPassword;//确认密码
    private String phone;
    private String phoneVerificationCode;
    private String email;
    private String emailVerificationCode;;


}