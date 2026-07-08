package com.github.doyxs.blocksnap.common.exception;


import com.github.doyxs.blocksnap.common.enums.ResultCode;
import lombok.Getter;

/**
 * 自定义业务异常
 */
@Getter
public class ApiException extends RuntimeException {
    
    private final int code;
    private final String message;

    public ApiException(String message) {
        super(message);
        this.code = ResultCode.FAILED.getCode();
        this.message = message;
    }

    public ApiException(ResultCode resultCode) {
        super(resultCode.getMessage());
        this.code = resultCode.getCode();
        this.message = resultCode.getMessage();
    }
}