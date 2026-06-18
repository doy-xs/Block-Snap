package com.github.doyxs.blocksnap.system.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.github.doyxs.blocksnap.system.model.entity.SysUser;
import org.apache.ibatis.annotations.Mapper;

@Mapper // 让 Spring Boot 识别这是一个 Mapper 接口并生成代理对象
public interface SysUserMapper extends BaseMapper<SysUser> {
    // BaseMapper<SysUser> 已经包含了 insert, delete, update, selectById 等基础方法
    // 只有遇到极其复杂的连表查询时，才需要在这里手写方法和 XML
}