package com.github.doyxs.blocksnap.system.model.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("sys_user_mark")
public class SysUserMark {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    private String targetType;

    private String targetKey;

    private Integer favorite;

    private String note;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}
