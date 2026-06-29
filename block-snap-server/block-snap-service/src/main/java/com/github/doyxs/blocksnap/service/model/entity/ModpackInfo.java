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
public class ModpackInfo {

    @TableId(type = IdType.AUTO)
    private Integer id;

    private Integer platform;

    private Integer modpackId;

    private String name;

    private String version;

    private Integer versionId;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}
