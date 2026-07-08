package com.github.doyxs.blocksnap.service.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.github.doyxs.blocksnap.common.constant.MarkConst;
import com.github.doyxs.blocksnap.common.enums.ResultCode;
import com.github.doyxs.blocksnap.common.exception.ApiException;
import com.github.doyxs.blocksnap.service.mapper.ShaderInfoMapper;
import com.github.doyxs.blocksnap.service.mapper.ShaderSnapshotMapper;
import com.github.doyxs.blocksnap.service.model.dto.ShaderFavoriteDTO;
import com.github.doyxs.blocksnap.service.model.dto.ShaderNoteDTO;
import com.github.doyxs.blocksnap.service.model.entity.ShaderSnapshot;
import com.github.doyxs.blocksnap.service.model.vo.ShaderVO;
import com.github.doyxs.blocksnap.service.service.ShaderService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ShaderServiceImpl implements ShaderService {
    private final ShaderInfoMapper shaderInfoMapper;
    private final ShaderSnapshotMapper  shaderSnapshotMapper;
    
    
    @Override
    public ShaderVO listByInstanceId(Long userId, Integer instanceId) {
        return null;
    }
    
    @Override
    public void favorite(Long userId, ShaderFavoriteDTO shaderFavoriteDTO) {
        Integer favorite = shaderFavoriteDTO.getFavorite();
        if (favorite == null || !(favorite == 0 || favorite == 1)) throw new ApiException(ResultCode.FAILED);
        upsertShaderMark(userId, shaderFavoriteDTO.getShaderId(), favorite, null);
    }
    
    @Override
    public void note(Long userId, ShaderNoteDTO shaderNoteDTO) {
        upsertShaderMark(userId, shaderNoteDTO.getShaderId(), null, shaderNoteDTO.getNote());
    }

    private void upsertShaderMark(Long userId, Integer shaderId, Integer favorite, String note) {
        if (!shaderSnapshotMapper.exists(Wrappers.<ShaderSnapshot>lambdaQuery().eq(ShaderSnapshot::getId, shaderId))) {
            throw new ApiException(ResultCode.FAILED);
        }
        int updated = shaderInfoMapper.updateShaderMark(userId, shaderId, MarkConst.TARGET_TYPE_SHADER, favorite, note);
        if (updated == 0) {
            shaderInfoMapper.insertShaderMark(userId, shaderId, MarkConst.TARGET_TYPE_SHADER, favorite, note);
        }
    }
}
