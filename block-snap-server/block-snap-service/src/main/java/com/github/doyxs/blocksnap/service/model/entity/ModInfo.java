package com.github.doyxs.blocksnap.service.model.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@TableName("mod_info")
public class ModInfo {

    @TableId(type = IdType.AUTO)
    private Integer id;

    private String name;

    private String hash;

    private Integer platform;

    private String version;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}
