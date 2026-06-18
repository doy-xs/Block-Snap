package com.github.doyxs.blocksnap.system.model.dto;

import lombok.Data;

@Data
public class VerifyAccountDto {

    private String account;
    private String verificationCode;
}
