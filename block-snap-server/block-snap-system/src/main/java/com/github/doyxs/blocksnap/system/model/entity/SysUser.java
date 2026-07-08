package com.github.doyxs.blocksnap.system.model.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class SysUser {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String username;
    @JsonIgnore
    private String password;
    private String nickname;
    private String phone;
    private String email;
    private String remark;
    private String lastLoginIp;
    private LocalDateTime lastLoginTime;
    private Integer status;
    @JsonIgnore
    private Integer isDeleted;

    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
