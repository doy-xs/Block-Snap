package com.github.doyxs.blocksnap.system.model.dto;

import lombok.Data;

@Data
public class ForgotPasswordDto {
    private String account;
    private String verificationCode;
    private String resetPassword;
    private String confirmResetPassword;
}
