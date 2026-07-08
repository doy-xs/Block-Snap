package com.github.doyxs.blocksnap.service.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.github.doyxs.blocksnap.common.constant.MarkConst;
import com.github.doyxs.blocksnap.common.enums.ResultCode;
import com.github.doyxs.blocksnap.common.exception.ApiException;
import com.github.doyxs.blocksnap.service.mapper.ResourceInfoMapper;
import com.github.doyxs.blocksnap.service.mapper.ResourceSnapshotMapper;
import com.github.doyxs.blocksnap.service.model.dto.ResourceFavoriteDTO;
import com.github.doyxs.blocksnap.service.model.dto.ResourceNoteDTO;
import com.github.doyxs.blocksnap.service.model.entity.ResourceSnapshot;
import com.github.doyxs.blocksnap.service.model.vo.ResourceVO;
import com.github.doyxs.blocksnap.service.service.ResourceService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ResourceServiceImpl implements ResourceService {
    private final ResourceInfoMapper resourceInfoMapper;
    private final ResourceSnapshotMapper resourceSnapshotMapper;
    @Override
    public ResourceVO listByInstanceId(Long userId, Integer instanceId) {
        return null;
    }
    
    @Override
    public void favorite(Long userId, ResourceFavoriteDTO resourceFavoriteDTO) {
        Integer favorite = resourceFavoriteDTO.getFavorite();
        if (favorite == null || !(favorite == 0 || favorite == 1)) throw new ApiException(ResultCode.FAILED);
        upsertResourceMark(userId, resourceFavoriteDTO.getResourceId(), favorite, null);
    }
    
    @Override
    public void note(Long userId, ResourceNoteDTO resourceNoteDTO) {
        upsertResourceMark(userId, resourceNoteDTO.getResourceId(), null, resourceNoteDTO.getNote());
    }

    private void upsertResourceMark(Long userId, Integer resourceId, Integer favorite, String note) {
        if (!resourceSnapshotMapper.exists(Wrappers.<ResourceSnapshot>lambdaQuery().eq(ResourceSnapshot::getId, resourceId))) {
            throw new ApiException(ResultCode.FAILED);
        }
        int updated = resourceInfoMapper.updateResourceMark(userId, resourceId, MarkConst.TARGET_TYPE_RESOURCE, favorite, note);
        if (updated == 0) {
            resourceInfoMapper.insertResourceMark(userId, resourceId, MarkConst.TARGET_TYPE_RESOURCE, favorite, note);
        }
    }
}
