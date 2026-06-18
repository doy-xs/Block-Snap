package com.github.doyxs.blocksnap.service.model.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("mod_snapshot")
public class ModSnapshot {

    @TableId(type = IdType.AUTO)
    private Integer id;

    private Integer snapshotId;

    private Integer modInfoId;

    private String version;

    private Integer isLatestVersion;

    private String modHash;

    private Integer loadTime;

    private String note;

    private Integer isDelete;

    private Integer favorited;

    private LocalDateTime addedTime;

    private LocalDateTime updateTime;

    private LocalDateTime createTime;
}
