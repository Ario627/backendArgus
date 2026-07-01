import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DestinationEntity } from "src/database/entities/destination.entity";
import { DestinationService } from "./destination.service";
import { DestinationController } from "./destination.controller";

@Module({
    imports: [TypeOrmModule.forFeature([DestinationEntity])],
    controllers: [DestinationController],
    providers: [DestinationService],
    exports: [DestinationService],
})
export class DestinationModule {}