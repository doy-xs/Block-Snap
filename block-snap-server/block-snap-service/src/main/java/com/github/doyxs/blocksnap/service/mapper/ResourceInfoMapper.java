package com.github.doyxs.blocksnap.service.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.github.doyxs.blocksnap.service.model.entity.ResourceInfo;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface ResourceInfoMapper extends BaseMapper<ResourceInfo> {
    int updateResourceMark(@Param("userId") Long userId,
                           @Param("resourceId") Integer resourceId,
                           @Param("targetType") Integer targetType,
                           @Param("favorite") Integer favorite,
                           @Param("note") String note);

    int insertResourceMark(@Param("userId") Long userId,
                           @Param("resourceId") Integer resourceId,
                           @Param("targetType") Integer targetType,
                           @Param("favorite") Integer favorite,
                           @Param("note") String note);
}
