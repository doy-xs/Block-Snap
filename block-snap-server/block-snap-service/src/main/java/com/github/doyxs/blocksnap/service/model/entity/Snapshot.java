package com.github.doyxs.blocksnap.service.model.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("snapshot")
public class Snapshot {

    @TableId(type = IdType.AUTO)
    private Integer id;

    private Integer instanceId;

    private LocalDateTime snapshotTime;

    private String mcVersion;

    private String loaderType;

    private String loaderVersion;

    private String javaVersion;

    private Integer ramAllocated;

    private String os;

    private Integer gameReadyMs;

    private Integer totalLoadMs;

    private Integer modCount;

    private Integer resourceCount;

    private Integer shaderCount;

    private Integer configCount;

    private LocalDateTime createTime;
}
