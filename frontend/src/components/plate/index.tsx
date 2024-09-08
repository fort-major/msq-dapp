import { styled } from "solid-styled-components";
import { COLOR_GRAY_105, COLOR_GRAY_115 } from "../../ui-kit";

export const Plate = styled.div<{
  bg?: string;
  p?: string;
  row?: boolean;
  gap?: string;
  pointer?: boolean;
  bgHover?: boolean;
}>`
  display: flex;
  flex-flow: ${(props) => (props.row ? "row" : "column")};
  padding: ${(props) => props.p ?? "15px"};
  gap: ${(props) => (props.gap ? props.gap : "15px")};

  background: ${(props) => props.bg ?? "unset"};
  border: 1px solid ${COLOR_GRAY_115};
  border-radius: 25px;

  ${(props) => (props.pointer ? "cursor: pointer;" : "")}
  transition: background-color 0.3s;
  background-color: transparent;

  &:hover {
    ${(props) => (props.bgHover ? `background-color: ${COLOR_GRAY_105};` : "")}
  }
`;
