package com.github.doyxs.blocksnap.system.controller;

import com.github.doyxs.blocksnap.common.api.Result;
import com.github.doyxs.blocksnap.common.utils.IpUtils;
import com.github.doyxs.blocksnap.system.model.dto.*;
import com.github.doyxs.blocksnap.system.model.entity.SysUser;
import com.github.doyxs.blocksnap.system.service.ISysUserService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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

    /**
     * 查询当前用户账户。需登录（Authorization）；X-User-Id 由网关注入。
     * Verify-Token 可选：有效则 phone/email 完整，否则脱敏（不报错）。
     */
    @GetMapping("/getAccount")
    public Result<List<SysUser>> getAccount(
            @RequestHeader("X-User-Id") Long userId,
            @RequestHeader(value = "Verify-Token", required = false) String verifyToken) {
        return sysUserService.getAccount(userId, verifyToken);
    }

}
