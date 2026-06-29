package com.github.doyxs.blocksnap.system.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.github.doyxs.blocksnap.common.api.Result;
import com.github.doyxs.blocksnap.system.model.dto.*;
import com.github.doyxs.blocksnap.system.model.entity.SysUser;

import java.util.List;

// 继承 MP 提供的 IService，它比 BaseMapper 提供了更丰富的业务级方法（如批量插入、分页等）
public interface ISysUserService extends IService<SysUser> {
    Result<String> login(String username, String password, String ip);
    // 注册逻辑
    Result<String> register(RegisterDTO dto);
    Result<String> sendVerificationCode(SendVerificationCodeDto dto);
    // 【修改】：加上 scene 参数


    Result<String> forgotPassword(ForgotPasswordDto dto);


    Result<String> verifyAccount(Long userId, VerifyAccountDto dto);
    Result<String> bindAccount(Long userId, BindAccountDTO dto);
    Result<String> updatePassword(Long userId, UpdatePasswordDTO dto);

    Result<String> logout(Long userId);

    /**
     * 查询当前登录用户账户。
     * Verify-Token 有效则返回完整手机/邮箱，否则脱敏；始终不返回 password。
     */
    Result<List<SysUser>> getAccount(Long userId, String verifyToken);
}
