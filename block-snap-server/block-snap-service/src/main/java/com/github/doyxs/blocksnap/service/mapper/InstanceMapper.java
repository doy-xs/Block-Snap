package com.github.doyxs.blocksnap.service.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.github.doyxs.blocksnap.service.model.entity.Instance;
import com.github.doyxs.blocksnap.service.model.vo.InstanceVO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface InstanceMapper extends BaseMapper<Instance> {

    List<InstanceVO> selectListByUserId(@Param("userId") Long userId);

    /**
     * 跨库部分更新 block_snap_system.sys_user_mark 的收藏/备注。
     * favorite / note 谁不为 null 就更新谁，均为 null 则只刷新 update_time。
     *
     * @return 受影响行数；0 表示该用户对该实例尚无标记记录
     */
    int updateInstanceMark(@Param("userId") Long userId,
                           @Param("instanceId") Integer instanceId,
                           @Param("targetType") Integer targetType,
                           @Param("favorite") Integer favorite,
                           @Param("note") String note);

    /**
     * 跨库插入一条 block_snap_system.sys_user_mark 标记。
     * favorite / note 为 null 的列交给数据库默认值。
     */
    int insertInstanceMark(@Param("userId") Long userId,
                           @Param("instanceId") Integer instanceId,
                           @Param("targetType") Integer targetType,
                           @Param("favorite") Integer favorite,
                           @Param("note") String note);
}
