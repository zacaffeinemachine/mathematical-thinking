// Everything a circuit problem page needs, from one import path:
//
//   import {
//     CircuitProblem, CircuitBuilder, PredictOutput, FillTable, FindSetting,
//     PickCircuit, Switch, Bulb, SwitchRow, LampRow, SealedBox, TruthTable,
//     GateIcon, CircuitPicture, tableOf, columnsOf,
//   } from "../../components/games/circuits/problems";
//
// Interactive (render with client:visible): CircuitBuilder, PredictOutput,
// FillTable, FindSetting, PickCircuit.
// Static (no client directive): CircuitProblem and every picture helper.
// See SITE_OVERVIEW.md, "Circuit problem pattern".

export { default as CircuitProblem } from "./CircuitProblem";
export { default as CircuitBuilder } from "./CircuitBuilder";
export { default as PredictOutput } from "./PredictOutput";
export { default as FillTable } from "./FillTable";
export { default as FindSetting } from "./FindSetting";
export { default as PickCircuit } from "./PickCircuit";
export { Switch, Bulb, SwitchRow, LampRow, SealedBox, TruthTable, GateIcon, CircuitPicture } from "./helpers";
export { tableOf, columnsOf } from "./engine";

export type { CircuitBuilderProps, StartDesign } from "./CircuitBuilder";
export type { PredictOutputProps } from "./PredictOutput";
export type { FillTableProps } from "./FillTable";
export type { FindSettingProps } from "./FindSetting";
export type { PickCircuitProps, PickOption } from "./PickCircuit";
export type { TargetSpec, Column, Limits, CheckResult } from "./engine";
export type { CircuitSpec, GateType, Bit } from "../model";
