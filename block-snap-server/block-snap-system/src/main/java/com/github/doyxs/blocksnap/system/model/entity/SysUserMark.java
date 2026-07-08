package com.github.doyxs.blocksnap.system.model.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SysUserMark {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    /** 目标表主键，如 instance.id、mod_snapshot.id、modpack_info.id */
    private Integer targetId;

    /**
     * 目标类型：1 INSTANCE 2 MOD 3 MODPACK 4 RESOURCE 5 SHADER 6 CONFIG
     * @see com.github.doyxs.blocksnap.common.constant.MarkConst
     */
    private Integer targetType;

    private Integer favorite;

    private String note;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}
