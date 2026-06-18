package com.github.doyxs.blocksnap.service.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.github.doyxs.blocksnap.common.exception.ApiException;
import com.github.doyxs.blocksnap.service.mapper.ModInfoMapper;
import com.github.doyxs.blocksnap.service.mapper.ModSnapshotMapper;
import com.github.doyxs.blocksnap.service.model.entity.ModInfo;
import com.github.doyxs.blocksnap.service.model.vo.ModDetailVO;
import com.github.doyxs.blocksnap.service.service.IModService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ModServiceImpl implements IModService {

    @Autowired
    private ModInfoMapper modInfoMapper;

    @Autowired
    private ModSnapshotMapper modSnapshotMapper;

    @Override
    public List<ModInfo> listModInfo() {
        return modInfoMapper.selectList(
                new LambdaQueryWrapper<ModInfo>().orderByAsc(ModInfo::getName)
        );
    }

    @Override
    public ModInfo getModInfoById(Integer id) {
        ModInfo modInfo = modInfoMapper.selectById(id);
        if (modInfo == null) {
            throw new ApiException("模组不存在");
        }
        return modInfo;
    }

    @Override
    public List<ModDetailVO> listModsBySnapshotId(Integer snapshotId, boolean includeDeleted) {
        if (snapshotId == null) {
            throw new ApiException("snapshotId 不能为空");
        }
        return modSnapshotMapper.selectDetailsBySnapshotId(snapshotId, includeDeleted);
    }
}
