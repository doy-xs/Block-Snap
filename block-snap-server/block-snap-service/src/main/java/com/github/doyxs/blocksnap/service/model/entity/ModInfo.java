package com.github.doyxs.blocksnap.service.model.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("mod_info")
public class ModInfo {

    @TableId(type = IdType.AUTO)
    private Integer id;

    private String name;

    private String sourcePlatform;

    private String latestVersion;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}
