
import { Button, useTheme } from '@mui/material';
// eslint-disable-next-line import/named
import { SxProps } from '@mui/system';
import { makeStyles } from '@mui/styles';
import { alpha, Theme } from '@mui/system';

type ColorProp = 'inherit' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';

const useStyles = makeStyles((theme: Theme) => ({
    buttonGray: {
        backgroundColor: '#808080',
        color: '#ffffff',
        fontSize: '16px',
        '&:hover': {
          opacity: 0.9,
          color: '#A9A9A9',
          backgroundColor: '#B8B8B8',
        },
    }
 }));


export interface ButtonProps {
  color?: ColorProp;
  component?: React.ReactNode;
  disabled?: boolean;
  fab?: boolean;
  href?: string;
  variant?: 'text' | 'outlined' | 'contained';
  children: React.ReactNode;
  onClick?: () => void;
  [rest: string]: any;
  type?: 'button' | 'reset' | 'submit';
  padding?: string;
  margin?: string;
  width?: string;
  height?: string;
  style?: SxProps<Theme>;
}

const PrimaryButton: React.FC<ButtonProps> = ({
  variant = 'contained',
  color = 'inherit',
  disabled = false,
  children,
  onClick,
  type = 'button',
  margin = '3px',
  padding = '12px 50px',
  width = '170px',
  height = '46px',
  style,
  ...rest
}) => {
  const theme = useTheme();
  const classes = useStyles(theme);

  return (
    <Button
      type={type}
      className={classes.buttonGray}
      onClick={onClick}
      variant={variant}
      color={color}
      disabled={disabled}
      sx={{
        height: height,
        padding: padding,
        margin: margin,
        width: width,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Button>
  );
};

export default PrimaryButton;
