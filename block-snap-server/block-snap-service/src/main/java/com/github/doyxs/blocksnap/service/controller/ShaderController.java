package com.github.doyxs.blocksnap.service.controller;

import com.github.doyxs.blocksnap.common.api.Result;
import com.github.doyxs.blocksnap.service.model.dto.ShaderFavoriteDTO;
import com.github.doyxs.blocksnap.service.model.dto.ShaderNoteDTO;
import com.github.doyxs.blocksnap.service.service.ShaderService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/svc-shader")
@RequiredArgsConstructor
public class ShaderController {
    private final ShaderService shaderService;
    
    @GetMapping("/list")
    public Result<Object> list(@RequestHeader("X-User-Id") Long userId,
                               @RequestParam("instanceId") Integer instanceId) {
        return Result.success(shaderService.listByInstanceId(userId, instanceId));
    }
    @PutMapping("/favorite")
    public Result<String> favorite(@RequestHeader("X-User-Id") Long userId, @RequestBody ShaderFavoriteDTO shaderFavoriteDTO) {
        shaderService.favorite(userId, shaderFavoriteDTO);
        return Result.success("修改成功");
    }
    @PutMapping("/note")
    public Result<String> note(@RequestHeader("X-User-Id") Long userId, @RequestBody ShaderNoteDTO  shaderNoteDTO) {
        shaderService.note(userId, shaderNoteDTO);
        return Result.success("修改成功");
    }
}
