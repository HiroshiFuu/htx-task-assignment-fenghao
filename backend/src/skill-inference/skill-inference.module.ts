import { Module } from '@nestjs/common';
import { SkillClassifier } from './skill-classifier';
import { createSkillClassifier } from './skill-classifier.factory';

@Module({
  providers: [
    { provide: SkillClassifier, useFactory: () => createSkillClassifier() },
  ],
  exports: [SkillClassifier],
})
export class SkillInferenceModule {}
