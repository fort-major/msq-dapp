import { COLOR_GRAY_115, COLOR_GRAY_140, COLOR_WHITE } from "../../ui-kit";
import { Copyable } from "../../ui-kit/copyable";
import { Text } from "../../ui-kit/typography";
import { Block, Img } from "../markup";
import { Plate } from "../plate";

export const Shop = (props: { id: bigint; iconSrc: string; name: string; description: string }) => {
  return (
    <Plate p="24px" gap="40px" bg={COLOR_GRAY_115}>
      <Block items="flex-start" content="space-between">
        <Block items="flex-start" gap="16px">
          <Img rounded w="48px" h="48px" src={props.iconSrc} />
          <Block flow="column" gap="8px">
            <Text weight={600} color={COLOR_WHITE} size={24} lineHeight={133}>
              {props.name}
            </Text>
            <Text weight={500} color={COLOR_GRAY_140} size={14} lineHeight={133}>
              {props.description}
            </Text>
          </Block>
        </Block>
        <Copyable before="ID:" text={props.id.toString()} />
      </Block>
    </Plate>
  );
};
