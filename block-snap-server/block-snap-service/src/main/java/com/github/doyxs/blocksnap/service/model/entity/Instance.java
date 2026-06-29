package com.github.doyxs.blocksnap.service.model.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Instance {

    @TableId(type = IdType.AUTO)
    private Integer id;

    private Long modpackInfoId;

    private Long userId;

    private String clientKey;

    private String name;

    
    private Integer isDeleted;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}
