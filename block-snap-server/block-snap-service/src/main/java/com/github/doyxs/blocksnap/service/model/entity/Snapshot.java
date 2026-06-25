package com.github.doyxs.blocksnap.service.model.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@TableName("snapshot")
public class Snapshot {

    @TableId(type = IdType.AUTO)
    private Integer id;

    @TableField("instance_id")
    private Integer instanceId;

    private String mcVersion;

    private Integer loaderType;

    private String loaderVersion;

    private String javaVersion;

    private Integer loadMs;

    private LocalDateTime snapshotTime;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}
