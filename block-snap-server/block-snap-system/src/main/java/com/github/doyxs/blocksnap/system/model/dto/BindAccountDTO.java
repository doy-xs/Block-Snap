package com.github.doyxs.blocksnap.system.model.dto;

import lombok.Data;

@Data
public class BindAccountDTO {

    // 可以是手机号，也可以是邮箱
    private String account;

    private String verificationCode;

}