package com.github.doyxs.blocksnap.system.controller;

import com.github.doyxs.blocksnap.common.api.Result;
import com.github.doyxs.blocksnap.common.constant.RedisConst;
import com.github.doyxs.blocksnap.common.constant.SceneConst;
import com.github.doyxs.blocksnap.common.utils.IpUtils;
import com.github.doyxs.blocksnap.system.model.dto.*;
import com.github.doyxs.blocksnap.system.service.ISysUserService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/sys-user")
public class SysUserController {

    @Autowired
    private ISysUserService sysUserService;

    @Autowired
    private RedisTemplate<String, String> redisTemplate;

    @PostMapping("/login")
    public Result<String> login(@RequestBody LoginDTO loginDTO, HttpServletRequest request) {
        return sysUserService.login(loginDTO.getUsername(), loginDTO.getPassword(), IpUtils.getIpAddr(request));
    }

    @PostMapping("/register")
    public Result<String> register(@RequestBody RegisterDTO registerDTO) {
        return sysUserService.register(registerDTO);
    }

    @PostMapping("/logout")
    public Result<String> logout(@RequestHeader("X-User-Id") Long userId) {
        return sysUserService.logout(userId); // 不再需要注入 RedisTemplate
    }
    @PostMapping("/send-verification-code")
    public Result<String> sendVerificationCode(@RequestBody SendVerificationCodeDto dto){
        return sysUserService.sendVerificationCode(dto);
    }

    @PostMapping("/forgot-password")
    public Result<String> forgotPassword(@RequestBody ForgotPasswordDto dto){
        return sysUserService.forgotPassword(dto);
    }

    @PostMapping("/verify-account")
    public Result<String> verifyAccount(@RequestHeader("X-User-Id") Long userId, @RequestBody VerifyAccountDto dto) {
        return sysUserService.verifyAccount(userId, dto);
    }

    @PostMapping("/update-password")
    public Result<String> updatePassword(@RequestHeader("X-User-Id") Long userId, @RequestBody UpdatePasswordDTO dto) {
        return sysUserService.updatePassword(userId, dto);
    }

    @PostMapping("/bind-account")
    public Result<String> bindAccount(@RequestHeader("X-User-Id") Long userId, @RequestBody BindAccountDTO bindAccountDTO) {
        return sysUserService.bindAccount(userId, bindAccountDTO);
    }
}