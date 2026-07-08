package com.github.doyxs.blocksnap.system.controller;

import com.github.doyxs.blocksnap.common.api.Result;
import com.github.doyxs.blocksnap.system.model.dto.*;
import com.github.doyxs.blocksnap.system.model.entity.SysUser;
import com.github.doyxs.blocksnap.system.service.ISysUserService;
import com.github.doyxs.blocksnap.system.util.IpUtils;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/sys-user")
public class SysUserController {

    private final ISysUserService sysUserService;

    public SysUserController(ISysUserService sysUserService) {
        this.sysUserService = sysUserService;
    }

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
    public Result<String> sendVerificationCode(@RequestBody SendVerificationCodeDto dto) {
        return sysUserService.sendVerificationCode(dto);
    }
    
    @PostMapping("/forgot-password")
    public Result<String> forgotPassword(@RequestBody ForgotPasswordDto dto) {
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
    
    @GetMapping("/getAccount")
    public Result<List<SysUser>> getAccount(@RequestHeader("X-User-Id") Long userId, @RequestHeader(value = "Verify-Token", required = false) String verifyToken) {
        return sysUserService.getAccount(userId, verifyToken);
    }
    
    @PostMapping("/update-nickname")
    public Result<String> updateNickname(@RequestHeader("X-User-Id") Long userId, @RequestBody SysUser sysUser) {
        sysUserService.updateNickname(userId, sysUser);
        return Result.success("修改成功！");
    }
    
    @PostMapping("/update-username")
    public Result<String> updateUsername(@RequestHeader("X-User-Id") Long userId, @RequestBody SysUser sysUser) {
        sysUserService.updateUsername(userId, sysUser);
        return Result.success("修改成功!");
    }
}
