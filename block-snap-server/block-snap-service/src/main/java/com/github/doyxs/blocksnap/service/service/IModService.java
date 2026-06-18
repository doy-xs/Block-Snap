package com.github.doyxs.blocksnap.service.service;

import com.github.doyxs.blocksnap.service.model.entity.ModInfo;
import com.github.doyxs.blocksnap.service.model.vo.ModDetailVO;

import java.util.List;

public interface IModService {

    List<ModInfo> listModInfo();

    ModInfo getModInfoById(Integer id);

    List<ModDetailVO> listModsBySnapshotId(Integer snapshotId, boolean includeDeleted);
}
