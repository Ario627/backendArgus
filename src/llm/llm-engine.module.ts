import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LlmEngineService } from './llm-engine.service';

@Module({
  imports: [HttpModule],
  providers: [LlmEngineService],
  exports: [LlmEngineService],
})
export class LlmEngineModule {}
