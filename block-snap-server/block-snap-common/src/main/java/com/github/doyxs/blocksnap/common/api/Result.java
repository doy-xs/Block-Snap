package com.github.doyxs.blocksnap.common.api;

import com.github.doyxs.blocksnap.common.enums.ResultCode;
import lombok.Data;

@Data
public class Result<T> {
    
    private int code;    // HTTP 风格状态码（200/401/403/404/500），用 int 避免 JSON 序列化为 long 时前端精度问题
    private String message; // 提示信息
    private T data;       // 真正返回给前端的数据

    // 私有化构造方法，强制通过后面的静态方法来创建对象
    protected Result() {}

    protected Result(int code, String message, T data) {
        this.code = code;
        this.message = message;
        this.data = data;
    }

    // --- 成功返回 ---
    
    public static <T> Result<T> success(T data) {
        return new Result<>(ResultCode.SUCCESS.getCode(), ResultCode.SUCCESS.getMessage(), data);
    }

    public static <T> Result<T> success(T data, String message) {
        return new Result<>(ResultCode.SUCCESS.getCode(), message, data);
    }

    // --- 失败返回 ---
    
    public static <T> Result<T> failed(String message) {
        return new Result<>(ResultCode.FAILED.getCode(), message, null);
    }

    public static <T> Result<T> failed(ResultCode errorCode) {
        return new Result<>(errorCode.getCode(), errorCode.getMessage(), null);
    }
}