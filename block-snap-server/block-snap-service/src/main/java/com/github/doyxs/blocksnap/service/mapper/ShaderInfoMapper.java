package com.github.doyxs.blocksnap.service.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.github.doyxs.blocksnap.service.model.entity.ShaderInfo;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface ShaderInfoMapper extends BaseMapper<ShaderInfo> {
    int updateShaderMark(@Param("userId") Long userId,
                         @Param("shaderId") Integer shaderId,
                         @Param("targetType") Integer targetType,
                         @Param("favorite") Integer favorite,
                         @Param("note") String note);

    int insertShaderMark(@Param("userId") Long userId,
                         @Param("shaderId") Integer shaderId,
                         @Param("targetType") Integer targetType,
                         @Param("favorite") Integer favorite,
                         @Param("note") String note);
}
