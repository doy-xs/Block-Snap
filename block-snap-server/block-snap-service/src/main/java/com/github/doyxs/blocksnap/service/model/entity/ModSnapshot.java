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
@TableName("mod_snapshot")
public class ModSnapshot {

    @TableId(type = IdType.AUTO)
    private Integer id;

    private Integer snapshotId;

    private Integer modInfoId;

    private String version;

    private String modHash;

    private Long loadTime;

    private Integer isDelete;

    private LocalDateTime addedTime;

    private LocalDateTime updateTime;

    private LocalDateTime createTime;
}
