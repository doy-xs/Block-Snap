package com.github.doyxs.blocksnap.service.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.github.doyxs.blocksnap.common.constant.MarkConst;
import com.github.doyxs.blocksnap.common.enums.ResultCode;
import com.github.doyxs.blocksnap.common.exception.ApiException;
import com.github.doyxs.blocksnap.service.mapper.ModInfoMapper;
import com.github.doyxs.blocksnap.service.mapper.ModSnapshotMapper;
import com.github.doyxs.blocksnap.service.model.dto.ModFavoriteDTO;
import com.github.doyxs.blocksnap.service.model.dto.ModNoteDTO;
import com.github.doyxs.blocksnap.service.model.entity.ModSnapshot;
import com.github.doyxs.blocksnap.service.model.vo.ModVO;
import com.github.doyxs.blocksnap.service.service.ModService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;

import java.util.Collections;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ModServiceImpl implements ModService {

    private final ModSnapshotMapper modSnapshotMapper;
    private final ModInfoMapper modInfoMapper;

    @Override
    public List<ModVO> listByInstanceId(Long userId, Integer instanceId) {
        List<ModVO> list = modSnapshotMapper.selectListByInstanceId(userId, instanceId);
        return CollectionUtils.isEmpty(list) ? Collections.emptyList() : list;
    }

    @Override
    public void favorite(Long userId, ModFavoriteDTO modFavoriteDTO) {
        Integer favorite = modFavoriteDTO.getFavorite();
        if (favorite == null || !(favorite == 0 || favorite == 1)) throw new ApiException(ResultCode.FAILED);
        upsertModMark(userId, modFavoriteDTO.getModId(), favorite, null);
    }

    @Override
    public void note(Long userId, ModNoteDTO modNoteDTO) {
        upsertModMark(userId, modNoteDTO.getModId(), null, modNoteDTO.getNote());
    }

    private void upsertModMark(Long userId, Integer modId, Integer favorite, String note) {
        if (!modSnapshotMapper.exists(Wrappers.<ModSnapshot>lambdaQuery().eq(ModSnapshot::getId, modId))) {
            throw new ApiException(ResultCode.FAILED);
        }
        int updated = modInfoMapper.updateModMark(userId, modId, MarkConst.TARGET_TYPE_MOD, favorite, note);
        if (updated == 0) {
            modInfoMapper.insertModMark(userId, modId, MarkConst.TARGET_TYPE_MOD, favorite, note);
        }
    }
}
