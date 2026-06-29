package com.github.doyxs.blocksnap.system.service.impl;

import com.alibaba.cloud.commons.lang.StringUtils;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.github.doyxs.blocksnap.common.api.Result;
import com.github.doyxs.blocksnap.common.constant.RedisConst;
import com.github.doyxs.blocksnap.common.constant.RegexConst;
import com.github.doyxs.blocksnap.common.constant.SceneConst;
import com.github.doyxs.blocksnap.common.exception.ApiException;
import com.github.doyxs.blocksnap.common.utils.JwtUtils;
import com.github.doyxs.blocksnap.system.mapper.SysUserMapper;
import com.github.doyxs.blocksnap.system.model.dto.*;
import com.github.doyxs.blocksnap.system.model.entity.SysUser;
import com.github.doyxs.blocksnap.system.service.ISysUserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;
import java.util.Random;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Transactional(rollbackFor = Exception.class)
@Service
public class SysUserServiceImpl extends ServiceImpl<SysUserMapper, SysUser> implements ISysUserService {
    // 【优化】全局复用这一个加密器实例，提升性能，避免频繁 GC
    private static final BCryptPasswordEncoder PASSWORD_ENCODER = new BCryptPasswordEncoder();
    @Autowired
    private RedisTemplate<String, String> redisTemplate;
    
    @Override
    public Result<String> login(String account, String password, String ip) {
        LambdaQueryWrapper<SysUser> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SysUser::getUsername, account).or().eq(SysUser::getPhone, account).or().eq(SysUser::getEmail, account);
        SysUser user = baseMapper.selectOne(wrapper);
        if (user == null || !PASSWORD_ENCODER.matches(password, user.getPassword())) {
            return Result.failed("用户名或密码错误");
        }
        if (user.getStatus() == 0) {
            return Result.failed("账号已被禁用，请联系管理员");
        }
        SysUser updateUser = new SysUser();
        updateUser.setId(user.getId());
        updateUser.setLastLoginTime(java.time.LocalDateTime.now());
        updateUser.setLastLoginIp(ip);
        this.updateById(updateUser);
        String token = JwtUtils.generateToken(user.getId(), user.getUsername());
        redisTemplate.opsForValue().set(RedisConst.LOGIN_TOKEN_PREFIX + user.getId(), token, RedisConst.LOGIN_TOKEN_TTL, TimeUnit.HOURS);
        return Result.success("Bearer " + token, "登录成功");
    }
    
    @Override
    public Result<String> register(RegisterDTO dto) {
        if (dto.getConfirmPassword() == null || !dto.getPassword().equals(dto.getConfirmPassword())) {
            throw new ApiException("两次输入的密码不一致");
        }
        if (this.count(new LambdaQueryWrapper<SysUser>().eq(SysUser::getUsername, dto.getUsername())) > 0) {
            throw new ApiException("该用户名已被注册");
        }
        // 【优化】使用抽取的公共方法，逻辑瞬间清爽
        String phoneRedisKey = validateCodeAndGetRedisKey(dto.getPhone(), dto.getPhoneVerificationCode(), RegexConst.PHONE, "手机", SceneConst.REGISTER);
        if (phoneRedisKey != null && this.count(new LambdaQueryWrapper<SysUser>().eq(SysUser::getPhone, dto.getPhone())) > 0) {
            throw new ApiException("该手机号已被绑定");
        }
        String emailRedisKey = validateCodeAndGetRedisKey(dto.getEmail(), dto.getEmailVerificationCode(), RegexConst.EMAIL, "邮箱", SceneConst.REGISTER);
        if (emailRedisKey != null && this.count(new LambdaQueryWrapper<SysUser>().eq(SysUser::getEmail, dto.getEmail())) > 0) {
            throw new ApiException("该邮箱已被绑定");
        }
        SysUser user = new SysUser();
        user.setUsername(dto.getUsername());
        user.setPassword(PASSWORD_ENCODER.encode(dto.getPassword()));
        user.setNickname("新用户_" + System.currentTimeMillis());
        if (StringUtils.isNotBlank(dto.getPhone())) user.setPhone(dto.getPhone());
        if (StringUtils.isNotBlank(dto.getEmail())) user.setEmail(dto.getEmail());
        this.save(user);
        if (phoneRedisKey != null) redisTemplate.delete(phoneRedisKey);
        if (emailRedisKey != null) redisTemplate.delete(emailRedisKey);
        return Result.success("注册成功");
    }
    
    @Override
    public Result<String> bindAccount(Long userId, BindAccountDTO dto) {
        String account = dto.getAccount();
        boolean isEmail = account.matches(RegexConst.EMAIL);
        boolean isPhone = account.matches(RegexConst.PHONE);
        if (!isEmail && !isPhone) throw new ApiException("账号格式不正确");
        SysUser user = this.getById(userId);
        if (user == null) throw new ApiException("当前登录用户不存在");
        String redisCodeKey = RedisConst.VERIFY_CODE_PREFIX + SceneConst.BIND_ACCOUNT + ":" + account;
        String realCode = redisTemplate.opsForValue().get(redisCodeKey);
        if (realCode == null || !realCode.equals(dto.getVerificationCode())) {
            throw new ApiException("验证码错误或已失效");
        }
        boolean requiredVerifyBefore = StringUtils.isNotBlank(user.getEmail()) || StringUtils.isNotBlank(user.getPhone());
        LambdaQueryWrapper<SysUser> uniqueQuery = new LambdaQueryWrapper<>();
        if (isEmail) uniqueQuery.eq(SysUser::getEmail, account);
        else uniqueQuery.eq(SysUser::getPhone, account);
        if (this.count(uniqueQuery) > 0)
            throw new ApiException("该" + (isEmail ? "邮箱" : "手机号") + "已被其他账号绑定");
        SysUser updateUser = new SysUser();
        updateUser.setId(userId);
        if (isEmail) updateUser.setEmail(account);
        else updateUser.setPhone(account);
        this.updateById(updateUser);
        redisTemplate.delete(redisCodeKey);
        if (requiredVerifyBefore) {
            redisTemplate.delete(RedisConst.VERIFY_ACCOUNT_TOKEN_PREFIX + SceneConst.VERIFY_ACCOUNT + ":" + userId);
        }
        return Result.success("账户绑定成功");
    }
    
    @Override
    public Result<String> verifyAccount(Long userId, VerifyAccountDto dto) {
        String account = dto.getAccount();
        if (StringUtils.isBlank(dto.getVerificationCode())) throw new ApiException("验证码不能为空");
        SysUser currentUser = this.getById(userId);
        if (currentUser == null) throw new ApiException("用户不存在");
        if (!account.equals(currentUser.getPhone()) && !account.equals(currentUser.getEmail())) {
            throw new ApiException("非法操作：该账号不是您当前绑定的账号！");
        }
        String codeKey = RedisConst.VERIFY_CODE_PREFIX + SceneConst.VERIFY_ACCOUNT + ":" + account;
        String realVerificationCode = redisTemplate.opsForValue().get(codeKey);
        if (StringUtils.isBlank(realVerificationCode) || !realVerificationCode.equals(dto.getVerificationCode())) {
            throw new ApiException("验证码错误或已过期");
        }
        redisTemplate.delete(codeKey);
        String verifyAccountToken = UUID.randomUUID().toString().replace("-", "");
        redisTemplate.opsForValue().set(RedisConst.VERIFY_ACCOUNT_TOKEN_PREFIX + SceneConst.VERIFY_ACCOUNT + ":" + userId, verifyAccountToken, RedisConst.REBIND_TOKEN_TTL, TimeUnit.MINUTES);
        return Result.success(verifyAccountToken, "验证成功");
    }
    
    @Override
    public Result<String> forgotPassword(ForgotPasswordDto dto) {
        String account = dto.getAccount();
        SysUser user = this.getOne(new LambdaQueryWrapper<SysUser>().and(w -> w.eq(SysUser::getPhone, account).or().eq(SysUser::getEmail, account)));
        if (user == null) throw new ApiException("用户不存在");
        if (StringUtils.isBlank(dto.getVerificationCode())) throw new ApiException("验证码不为空");
        String redisKey = RedisConst.VERIFY_CODE_PREFIX + SceneConst.FORGOT_PASSWORD + ":" + account;
        if (!StringUtils.equals(redisTemplate.opsForValue().get(redisKey), dto.getVerificationCode())) {
            throw new ApiException("验证码错误或已过期");
        }
        if (StringUtils.isEmpty(dto.getResetPassword())) throw new ApiException("重置密码不为空");
        if (!StringUtils.equals(dto.getResetPassword(), dto.getConfirmResetPassword()))
            throw new ApiException("密码不一致");
        user.setPassword(PASSWORD_ENCODER.encode(dto.getResetPassword()));
        this.updateById(user);
        redisTemplate.delete(redisKey);
        redisTemplate.delete(RedisConst.LOGIN_TOKEN_PREFIX + user.getId());
        return Result.success("重置成功");
    }
    
    @Override
    public Result<String> sendVerificationCode(SendVerificationCodeDto dto) {
        String account = dto.getAccount();
        String scene = dto.getScene();
        if (StringUtils.isBlank(account)) throw new ApiException("账号不能为空");
        String cooldownKey = RedisConst.COOLDOWN_PREFIX + scene + ":" + account;
        if (redisTemplate.hasKey(cooldownKey)) {
            throw new ApiException("验证码发送太频繁，请60秒后再试");
        }
        boolean isEmail = account.matches(RegexConst.EMAIL);
        boolean isPhone = account.matches(RegexConst.PHONE);
        if (!isEmail && !isPhone) throw new ApiException("请输入正确的邮箱或手机号");
        LambdaQueryWrapper<SysUser> query = new LambdaQueryWrapper<>();
        if (isEmail) query.eq(SysUser::getEmail, account);
        else query.eq(SysUser::getPhone, account);
        boolean accountExists = this.count(query) > 0;
        if (SceneConst.REGISTER.equals(scene) || SceneConst.BIND_ACCOUNT.equals(scene)) {
            if (accountExists) throw new ApiException("该账号已被注册或绑定，无法发送");
        } else if (SceneConst.FORGOT_PASSWORD.equals(scene) || SceneConst.VERIFY_ACCOUNT.equals(scene)) {
            if (!accountExists) throw new ApiException("该账号不存在或未绑定，无法发送");
        }
        String code = String.valueOf(new Random().nextInt(899999) + 100000);
        String redisKey = RedisConst.VERIFY_CODE_PREFIX + scene + ":" + account;
        redisTemplate.opsForValue().set(redisKey, code, RedisConst.VERIFY_CODE_TTL, TimeUnit.MINUTES);
        redisTemplate.opsForValue().set(cooldownKey, "lock", RedisConst.COOLDOWN_TTL, TimeUnit.SECONDS);
        System.out.println("向 " + account + " 发送【" + scene + "】验证码：" + code);
        return Result.success("验证码发送成功");
    }
    
    @Override
    public Result<String> updatePassword(Long userId, UpdatePasswordDTO dto) {
        if (dto.getConfirmNewPassword() == null || !dto.getNewPassword().equals(dto.getConfirmNewPassword())) {
            throw new ApiException("两次输入的新密码不一致");
        }
        SysUser user = this.getById(userId);
        if (!PASSWORD_ENCODER.matches(dto.getOldPassword(), user.getPassword())) {
            throw new ApiException("原密码输入错误");
        }
        if (PASSWORD_ENCODER.matches(dto.getNewPassword(), user.getPassword())) {
            throw new ApiException("新密码不能与原密码相同");
        }
        user.setPassword(PASSWORD_ENCODER.encode(dto.getNewPassword()));
        this.updateById(user);
        redisTemplate.delete(RedisConst.VERIFY_ACCOUNT_TOKEN_PREFIX + SceneConst.VERIFY_ACCOUNT + ":" + userId);
        redisTemplate.delete(RedisConst.LOGIN_TOKEN_PREFIX + userId);
        return Result.success("密码修改成功，请重新登录");
    }
    
    /**
     * 【优化】抽取公共的验证码格式和缓存校验逻辑
     */
    private String validateCodeAndGetRedisKey(String account, String inputCode, String regex, String typeName, String scene) {
        if (StringUtils.isBlank(account)) return null;
        if (!account.matches(regex)) throw new ApiException(typeName + "格式不正确");
        if (StringUtils.isBlank(inputCode)) throw new ApiException(typeName + "验证码不能为空");
        String redisKey = RedisConst.VERIFY_CODE_PREFIX + scene + ":" + account;
        String realCode = redisTemplate.opsForValue().get(redisKey);
        if (realCode == null || !realCode.equals(inputCode)) {
            throw new ApiException(typeName + "验证码错误或已过期");
        }
        return redisKey;
    }
    
    @Override
    public Result<String> logout(Long userId) {
        this.clearUserAuthCache(userId);
        return Result.success("退出成功");
    }
    
    @Override
    public Result<List<SysUser>> getAccount(Long userId, String verifyToken) {
        SysUser user = this.getById(userId);
        if (user == null) {
            throw new ApiException("用户不存在");
        }
        boolean verified = false;
        if (StringUtils.isNotBlank(verifyToken)) {
            String redisKey = RedisConst.VERIFY_ACCOUNT_TOKEN_PREFIX + SceneConst.VERIFY_ACCOUNT + ":" + userId;
            String cached = redisTemplate.opsForValue().get(redisKey);
            verified = StringUtils.equals(cached, verifyToken);
        }
        SysUser row = new SysUser();
        row.setId(user.getId());
        row.setUsername(user.getUsername());
        row.setNickname(user.getNickname());
        row.setRemark(user.getRemark());
        row.setStatus(user.getStatus());
        row.setLastLoginIp(user.getLastLoginIp());
        row.setLastLoginTime(user.getLastLoginTime());
        row.setCreateTime(user.getCreateTime());
        row.setUpdateTime(user.getUpdateTime());
        if (verified) {
            row.setPhone(user.getPhone());
            row.setEmail(user.getEmail());
        } else {
            String phone = user.getPhone();
            if (StringUtils.isNotBlank(phone)) {
                String p = phone.trim();
                row.setPhone(p.length() == 11 ? p.substring(0, 3) + "****" + p.substring(7) : p.substring(0, Math.min(3, p.length())) + "****");
            }
            String email = user.getEmail();
            if (StringUtils.isNotBlank(email)) {
                String e = email.trim();
                int at = e.indexOf('@');
                row.setEmail(at > 0 ? e.charAt(0) + "***" + e.substring(at) : "***");
            }
        }
        return Result.success(Collections.singletonList(row));
    }
    
    private void clearUserAuthCache(Long userId) {
        // 清除二次验证 Token
        redisTemplate.delete(RedisConst.VERIFY_ACCOUNT_TOKEN_PREFIX + SceneConst.VERIFY_ACCOUNT + ":" + userId);
        // 清除登录 Token
        redisTemplate.delete(RedisConst.LOGIN_TOKEN_PREFIX + userId);
    }
}