package com.github.doyxs.blocksnap.service.model.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ModInfo {

    @TableId(type = IdType.AUTO)
    private Integer id;

    private String name;

    private String hash;

    private Integer platform;

    private String version;
    private String url;
    private String icon;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}
