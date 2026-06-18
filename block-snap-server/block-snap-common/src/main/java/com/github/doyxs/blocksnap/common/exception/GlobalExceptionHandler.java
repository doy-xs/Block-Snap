package com.github.doyxs.blocksnap.common.exception;

import com.github.doyxs.blocksnap.common.api.Result;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j // Lombok 注解，用于打印日志
@RestControllerAdvice // 告诉 Spring：这是一个全局增强的拦截器
public class GlobalExceptionHandler {

    /**
     * 1. 拦截我们自己主动抛出的业务异常（ApiException）
     */
    @ExceptionHandler(ApiException.class)
    public Result<String> handleApiException(ApiException e) {
        // 业务异常属于正常逻辑分支，不需要打印恐怖的错误堆栈，只打印一句话即可
        log.warn("业务异常：{}", e.getMessage());
        return Result.failed(e.getMessage());
    }
    @ExceptionHandler(DuplicateKeyException.class)
    public Result<String> handleDuplicateKeyException(DuplicateKeyException e) {
        log.warn("数据库唯一索引冲突：{}", e.getMessage());
        // 如果逻辑删除的用户占用了名字，报这个错误，前端体验更好，不会直接抛 500
        return Result.failed("该用户名已被占用（包含历史已注销账号），请更换一个重试");
    }
    /**
     * 2. 拦截所有未知的系统级异常（比如 NullPointerException, SQL 语法错误等）
     */
    @ExceptionHandler(Exception.class)
    public Result<String> handleException(Exception e) {
        // 系统异常是代码 Bug，必须在控制台打印完整的堆栈信息，方便程序员排错
        log.error("系统发生未知异常：", e);
        // 但给前端的提示必须是友好的，绝对不能把 SQL 错误暴露给前端
        return Result.failed("系统繁忙，请稍后再试");
    }
}