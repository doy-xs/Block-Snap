package com.github.doyxs.blocksnap.system.model.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Data;
import java.time.LocalDateTime;

@Data // Lombok 注解，自动生成 get/set/toString 方法
@TableName("sys_user") // 指定映射的数据库表名
public class SysUser {

    @TableId(type = IdType.AUTO) // 告诉 MP 这是主键。ASSIGN_ID 表示使用雪花算法自动生成分布式 ID
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